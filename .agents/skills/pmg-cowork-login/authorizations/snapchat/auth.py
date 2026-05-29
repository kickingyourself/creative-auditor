import os
import urllib.parse
import webbrowser
import threading
import ssl
from http.server import BaseHTTPRequestHandler, HTTPServer
import requests
from dotenv import load_dotenv, set_key

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)

CLIENT_ID = os.getenv('SNAPCHAT_CLIENT_ID')
CLIENT_SECRET = os.getenv('SNAPCHAT_CLIENT_SECRET')
REDIRECT_URI = 'https://127.0.0.1:8087/snapchatcallback'
SCOPE = 'snapchat-marketing-api'

if not CLIENT_ID or not CLIENT_SECRET:
    print("Error: SNAPCHAT_CLIENT_ID or SNAPCHAT_CLIENT_SECRET not found in .env file.")
    exit(1)

class AuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if 'code' in query_components:
            code = query_components['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Exchange code for token using client_secret
            token_url = "https://accounts.snapchat.com/login/oauth2/access_token"
            data = {
                'grant_type': 'authorization_code',
                'client_id': CLIENT_ID,
                'client_secret': CLIENT_SECRET,
                'redirect_uri': REDIRECT_URI,
                'code': code
            }
            
            try:
                response = requests.post(token_url, data=data)
                response.raise_for_status()
                token_data = response.json()
                
                access_token = token_data.get('access_token')
                refresh_token = token_data.get('refresh_token')
                
                if refresh_token:
                    set_key(dotenv_path, 'SNAPCHAT_REFRESH_TOKEN', refresh_token)
                    
                    print("Successfully retrieved and saved SNAPCHAT_REFRESH_TOKEN to .env")
                    self.wfile.write(b"<html><body><h1>Authorization Successful!</h1><p>You can close this window now.</p><script>window.close();</script></body></html>")
                else:
                    print("Failed to get access token from response.")
                    print(token_data)
                    self.wfile.write(b"<html><body><h1>Authorization Failed</h1><p>No access token returned.</p></body></html>")
            except requests.exceptions.RequestException as e:
                print(f"Error fetching token: {e}")
                if hasattr(e, 'response') and e.response is not None:
                     print(e.response.text)
                self.wfile.write(b"<html><body><h1>Authorization Failed</h1><p>Check terminal for details.</p></body></html>")
                
            threading.Thread(target=self.server.shutdown).start()
            
        else:
            self.send_response(400)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<html><body><h1>Authorization Failed</h1><p>No code provided.</p></body></html>")
            threading.Thread(target=self.server.shutdown).start()

    def log_message(self, format, *args):
        pass # suppress default logging

def main():
    server_address = ('', 8087)
    httpd = HTTPServer(server_address, AuthHandler)
    
    # SSL Setup
    certfile = os.path.join(os.path.dirname(__file__), 'cert.pem')
    keyfile = os.path.join(os.path.dirname(__file__), 'key.pem')
    if not os.path.exists(certfile) or not os.path.exists(keyfile):
        print("Generating self-signed SSL certificate for https://127.0.0.1...")
        os.system(f"openssl req -x509 -newkey rsa:4096 -nodes -out {certfile} -keyout {keyfile} -days 365 -subj '/CN=127.0.0.1' 2>/dev/null")
    
    httpd.socket = ssl.wrap_socket(httpd.socket, keyfile=keyfile, certfile=certfile, server_side=True)
    
    # Construct auth URL without PKCE
    auth_params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': SCOPE,
    }
    auth_url = f"https://accounts.snapchat.com/login/oauth2/authorize?{urllib.parse.urlencode(auth_params)}"
    
    print(f"Starting local server to handle callback on {REDIRECT_URI}...")
    print("Opening browser for authorization...")
    webbrowser.open(auth_url)
    
    # Run the server to wait for callback
    httpd.serve_forever()
    print("Server shut down.")

if __name__ == '__main__':
    main()
