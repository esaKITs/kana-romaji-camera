#!/usr/bin/env python3
"""Evaluate baseline and Klee fine-tune on NEVER-TRAINED printed Japanese lines.
Requires Pillow, Tesseract CLI and both model files. No deployment.
Usage: python evaluate_models.py --font /path/font.ttf --baseline /path/tessdata --candidate /path/klee_tessdata
"""
import argparse, os, subprocess, tempfile, unicodedata
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
TEXTS=[
"あさひがのぼる つきがしずむ", "しんぶんをよみます", "じてんしゃでがっこうへいきます",
"きょうはいいてんきですね", "おちゃをのみませんか", "きっぷをかいました",
"しゃしんをとってください", "りょこうのじゅんびをします",
"ギターをひきます", "シャツとズボン", "ジュースをのみたいです",
"チョコレートとクッキー", "レストランでランチ", "ピュアなイメージ",
"禁止されています", "漢字の横のふりがな", "お客様にご案内します",
"薬を飲んでください", "お子さんがいらっしゃいます", "食べられません",
"ちいさいゃゅょ と っ", "きゃくしつ しゅくだい しょうがつ",
"ざっしをよみました", "じゅぎょうがはじまります"
]
def norm(s):
    return ''.join(c for c in unicodedata.normalize('NFKC',s) if not c.isspace())
def distance(a,b):
    prev=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        curr=[i]+[0]*len(b)
        for j,y in enumerate(b,1):
            curr[j]=min(curr[j-1]+1,prev[j]+1,prev[j-1]+(x!=y))
        prev=curr
    return prev[-1]
def main():
    p=argparse.ArgumentParser()
    for flag in ('font','baseline','candidate'):p.add_argument('--'+flag,required=True,type=Path)
    p.add_argument('--size',type=int,default=30)
    a=p.parse_args()
    font=ImageFont.truetype(str(a.font),a.size)
    with tempfile.TemporaryDirectory() as tmp:
        errors={'jpn':0,'klee_jpn':0}; total=0
        for n,line in enumerate(TEXTS):
            bb=font.getbbox(line)
            im=Image.new('RGB',(bb[2]-bb[0]+60,max(70,bb[3]-bb[1]+40)),'white')
            ImageDraw.Draw(im).text((30-bb[0],20-bb[1]),line,font=font,fill='black')
            image=Path(tmp)/f'{n:02d}.png';im.save(image)
            truth=norm(line);total+=len(truth)
            for name,directory in [('jpn',a.baseline),('klee_jpn',a.candidate)]:
                env=os.environ.copy();env['TESSDATA_PREFIX']=str(directory)
                r=subprocess.run(['tesseract',str(image),'stdout','-l',name,'--psm','7'],capture_output=True,text=True,env=env)
                if r.returncode:raise RuntimeError(r.stderr)
                output=norm(r.stdout)
                errors[name]+=distance(truth,output)
                print(f'{n:02d} {name}: {output} / {truth}',flush=True)
        for name,err in errors.items():
            print(f'{name}: character error rate {err}/{total} = {err/total:.2%}')
if __name__=='__main__':main()
