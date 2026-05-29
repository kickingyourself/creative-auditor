import os
import urllib.parse
import webbrowser
import threading
import ssl
import hashlib
import base64
from http.server import BaseHTTPRequestHandler, HTTPServer
import requests
from dotenv import load_dotenv, set_key

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)

CLIENT_ID = os.getenv('SLACK_CLIENT_ID')
CLIENT_SECRET = os.getenv('SLACK_CLIENT_SECRET') # Optional for PKCE public clients
REDIRECT_URI = 'https://127.0.0.1:8086/slackcallback'
SCOPE = 'files:read,channels:history,channels:read,channels:write,search:read,search:read.mpim,search:read.im,search:read.users,chat:write,groups:read,groups:history'

if not CLIENT_ID:
    print("Error: SLACK_CLIENT_ID not found in .env file.")
    exit(1)

# PKCE Helpers
def generate_code_verifier():
    return base64.urlsafe_b64encode(os.urandom(40)).decode('utf-8').rstrip('=')

def generate_code_challenge(verifier):
    digest = hashlib.sha256(verifier.encode('utf-8')).digest()
    return base64.urlsafe_b64encode(digest).decode('utf-8').rstrip('=')

# Generate PKCE verifier before starting server so the handler can use it
code_verifier = generate_code_verifier()
code_challenge = generate_code_challenge(code_verifier)

class AuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if 'code' in query_components:
            code = query_components['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Exchange code for token
            token_url = "https://slack.com/api/oauth.v2.access"
            data = {
                'grant_type': 'authorization_code',
                'client_id': CLIENT_ID,
                'redirect_uri': REDIRECT_URI,
                'code': code,
                'code_verifier': code_verifier
            }
            if CLIENT_SECRET:
                data['client_secret'] = CLIENT_SECRET
                
            try:
                response = requests.post(token_url, data=data)
                response.raise_for_status()
                token_data = response.json()
                
                if token_data.get('ok'):
                    authed_user = token_data.get('authed_user', {})
                    refresh_token = token_data.get('refresh_token') or authed_user.get('refresh_token')
                    access_token = token_data.get('access_token') or authed_user.get('access_token')

                    if refresh_token:
                        set_key(dotenv_path, 'SLACK_REFRESH_TOKEN', refresh_token)
                        print("Successfully retrieved and saved SLACK_REFRESH_TOKEN to .env")
                        self.wfile.write(b"<html><body><h1>Authorization Successful!</h1><p>SLACK_REFRESH_TOKEN saved. You can close this window now.</p><script>window.close();</script></body></html>")
                    elif access_token:
                        # Fallback if refresh token isn't returned
                        set_key(dotenv_path, 'SLACK_REFRESH_TOKEN', access_token)
                        print("Successfully retrieved and saved access_token as SLACK_REFRESH_TOKEN to .env")
                        self.wfile.write(b"<html><body><h1>Authorization Successful!</h1><p>SLACK_REFRESH_TOKEN saved (using access_token). You can close this window now.</p><script>window.close();</script></body></html>")
                    else:
                        print("Failed to get token from response.")
                        print(token_data)
                        self.wfile.write(b"<html><body><h1>Authorization Failed</h1><p>No token returned.</p></body></html>")
                else:
                    print("Error from Slack API:")
                    print(token_data)
                    error_msg = token_data.get('error', 'Unknown error')
                    self.wfile.write(f"<html><body><h1>Authorization Failed</h1><p>{error_msg}</p></body></html>".encode('utf-8'))
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
    server_address = ('', 8086)
    httpd = HTTPServer(server_address, AuthHandler)
    
    # SSL Setup
    certfile = os.path.join(os.path.dirname(__file__), 'cert.pem')
    keyfile = os.path.join(os.path.dirname(__file__), 'key.pem')
    if not os.path.exists(certfile) or not os.path.exists(keyfile):
        print("Generating self-signed SSL certificate for https://127.0.0.1...")
        os.system(f"openssl req -x509 -newkey rsa:4096 -nodes -out {certfile} -keyout {keyfile} -days 365 -subj '/CN=127.0.0.1' 2>/dev/null")
    
    httpd.socket = ssl.wrap_socket(httpd.socket, keyfile=keyfile, certfile=certfile, server_side=True)
    
    # Construct auth URL with PKCE
    auth_params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'user_scope': SCOPE,
        'response_type': 'code',
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256'
    }
    
    auth_url = f"https://slack.com/oauth/v2/authorize?{urllib.parse.urlencode(auth_params)}"
    
    print(f"Starting local server to handle callback on {REDIRECT_URI}...")
    print("Opening browser for authorization...")
    webbrowser.open(auth_url)
    
    # Run the server to wait for callback
    httpd.serve_forever()
    print("Server shut down.")

if __name__ == '__main__':
    main()
