"""Real Japanese CLI OCR and geometry fixtures; no camera images are uploaded.
Usage: python scripts/verify-tesseract.py --font KleeOne-SemiBold.ttf --tessdata DIR --output DIR
"""
from pathlib import Path
import argparse,csv,io,json,subprocess
from PIL import Image,ImageDraw,ImageFont
p=argparse.ArgumentParser()
p.add_argument('--font',required=True,type=Path);p.add_argument('--tessdata',required=True,type=Path);p.add_argument('--output',required=True,type=Path)
a=p.parse_args();a.output.mkdir(exist_ok=True,parents=True)
font=ImageFont.truetype(str(a.font),48)
texts=['しないでください','つながりかねません','あなたのけんこう','きんじられています'];records=[]
for dark in [False,True]:
 for i,text in enumerate(texts):
  image=Image.new('RGB',(720,130),'#151515' if dark else '#f5f5f5');ImageDraw.Draw(image).text((35,30),text,font=font,fill='#f5f5f5' if dark else '#151515')
  file=a.output/f'{"black" if dark else "white"}-{i}.png';image.save(file)
  cmd=['tesseract',str(file),'stdout','--tessdata-dir',str(a.tessdata),'-l','jpn','--psm','7']
  result=subprocess.run(cmd,capture_output=True,text=True,check=True);actual=''.join(result.stdout.split())
  if actual!=text:raise AssertionError(f'{file.name}: {actual!r} != {text!r}')
  tsv=subprocess.run(cmd+['-c','tessedit_create_tsv=1'],capture_output=True,text=True,check=True)
  if not tsv.stdout.startswith('level\t'):raise AssertionError('Expected TSV geometry: '+tsv.stderr)
  lines={}
  for row in csv.DictReader(io.StringIO(tsv.stdout),delimiter='\t'):
   key=(row['block_num'],row['par_num'],row['line_num']);x,y,w,h=[int(row[k]) for k in ['left','top','width','height']];bbox={'x0':x,'y0':y,'x1':x+w,'y1':y+h}
   if row['level']=='4':lines[key]={'bbox':bbox,'words':[]}
   if row['level']=='5' and row['text'].strip():lines[key]['words'].append({'text':row['text'],'confidence':float(row['conf']),'bbox':bbox})
  if not lines:raise AssertionError('No OCR geometry')
  records.append({'image':file.name,'expected':text,'actual':actual,'data':{'blocks':[{'paragraphs':[{'lines':list(lines.values())}]}]}})
  print('PASS',file.name,actual,flush=True)
(a.output/'ocr-data.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
print('Real Japanese OCR: 8/8 passed')
