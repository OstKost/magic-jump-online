"""Verify HTTPS API and an authenticated WebSocket snapshot using the stdlib."""
import base64,json,os,socket,ssl,struct,sys,urllib.request,urllib.parse
base=sys.argv[1].rstrip('/')
with urllib.request.urlopen(base+'/api/health',timeout=15) as response:
 assert json.load(response)['status']=='ok'
request=urllib.request.Request(base+'/api/rooms',data=b'{}',headers={'Content-Type':'application/json'})
with urllib.request.urlopen(request,timeout=15) as response: room=json.load(response)
u=urllib.parse.urlsplit(base);port=u.port or (443 if u.scheme=='https' else 80)
sock=socket.create_connection((u.hostname,port),timeout=15)
if u.scheme=='https':sock=ssl.create_default_context().wrap_socket(sock,server_hostname=u.hostname)
key=base64.b64encode(os.urandom(16)).decode()
sock.sendall((f'GET /api/rooms/{room["code"]}/ws HTTP/1.1\r\nHost: {u.netloc}\r\nOrigin: {base}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Protocol: jump-v1\r\n\r\n').encode())
headers=b''
while not headers.endswith(b'\r\n\r\n'):headers+=sock.recv(1)
assert b'101 Switching Protocols' in headers,headers
payload=json.dumps({'token':room['token']}).encode();mask=os.urandom(4)
assert len(payload)<126
sock.sendall(bytes([0x81,0x80|len(payload)])+mask+bytes(v^mask[i%4] for i,v in enumerate(payload)))
def receive(n):
 data=b''
 while len(data)<n:
  chunk=sock.recv(n-len(data))
  if not chunk:raise RuntimeError('WebSocket closed')
  data+=chunk
 return data
head=receive(2);length=head[1]&127
if length==126:length=struct.unpack('!H',receive(2))[0]
if length==127:length=struct.unpack('!Q',receive(8))[0]
snapshot=json.loads(receive(length));assert snapshot['code']==room['code'];assert snapshot['members'][0]['connected']
sock.close();print('HTTPS health and authenticated WebSocket passed')
