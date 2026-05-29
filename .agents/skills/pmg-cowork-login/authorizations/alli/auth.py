import os
import urllib.parse
import webbrowser
import threading
import base64
import hashlib
from http.server import BaseHTTPRequestHandler, HTTPServer
import requests
from dotenv import load_dotenv, set_key

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)

REDIRECT_URI = 'http://localhost:8088/callback'

# Generate PKCE verifier and challenge
code_verifier = base64.urlsafe_b64encode(os.urandom(32)).rstrip(b'=').decode('utf-8')
code_challenge = base64.urlsafe_b64encode(hashlib.sha256(code_verifier.encode('utf-8')).digest()).rstrip(b'=').decode('utf-8')

class AuthHandler(BaseHTTPRequestHandler):
    client_id = None # Stored to access in callback

    def do_GET(self):
        query_components = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        print(f"Callback hit: {self.path}")
        print(f"Query components: {query_components}")
        if 'code' in query_components:
            code = query_components['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Exchange code and PKCE verifier for token (no client_secret required for public client)
            token_url = "https://login.alliplatform.com/token"
            data = {
                'grant_type': 'authorization_code',
                'client_id': self.client_id,
                'redirect_uri': REDIRECT_URI,
                'code': code,
                'code_verifier': code_verifier
            }
            
            try:
                response = requests.post(token_url, data=data)
                response.raise_for_status()
                token_data = response.json()
                
                access_token = token_data.get('access_token')
                refresh_token = token_data.get('refresh_token')
                
                if access_token:
                    set_key(dotenv_path, 'ALLI_ACCESS_TOKEN', access_token)
                    print("Successfully retrieved and saved ALLI_ACCESS_TOKEN to .env")
                if refresh_token:
                    set_key(dotenv_path, 'ALLI_REFRESH_TOKEN', refresh_token)
                    print("Successfully retrieved and saved ALLI_REFRESH_TOKEN to .env")
                
                if refresh_token:
                    self.wfile.write(b"<html><body><h1>Alli Authorization Successful!</h1><p>You can close this window now.</p><script>window.close();</script></body></html>")
                else:
                    print("Failed to get refresh token from response.")
                    print(token_data)
                    self.wfile.write(b"<html><body><h1>Authorization Completed without Refresh Token</h1><p>See terminal for details.</p></body></html>")
            except requests.exceptions.RequestException as e:
                print(f"Error fetching token: {e}")
                if hasattr(e, 'response') and e.response is not None:
                     print(e.response.text)
                self.wfile.write(b"<html><body><h1>Authorization Failed</h1><p>Check terminal for details.</p></body></html>")
                
            threading.Thread(target=self.server.shutdown).start()
            
        elif self.path.startswith('/callback') or self.path.startswith('/allicallback'):
            self.send_response(400)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"<html><body><h1>Authorization Failed</h1><p>No code provided.</p></body></html>")
            threading.Thread(target=self.server.shutdown).start()
        else:
            self.send_response(200)
            self.end_headers()

    def log_message(self, format, *args):
        pass # suppress default logging

def register_client_if_needed():
    client_id = os.getenv('ALLI_CLIENT_ID')
    if not client_id:
        print("Registering local public client dynamically...")
        reg_resp = requests.post("https://mcp.alliplatform.com/oauth/register", json={
            "client_name": "alli-4u-local-agent",
            "redirect_uris": [REDIRECT_URI],
            "token_endpoint_auth_method": "none"
        })
        reg_resp.raise_for_status()
        client_data = reg_resp.json()
        client_id = client_data['client_id']
        set_key(dotenv_path, 'ALLI_CLIENT_ID', client_id)
        print(f"Registered new client and saved ALLI_CLIENT_ID to .env: {client_id}")
    else:
        print(f"Using existing ALLI_CLIENT_ID from .env: {client_id}")
    return client_id

def main():
    try:
        client_id = register_client_if_needed()
    except Exception as e:
        print(f"Failed to load or register client dynamically: {e}")
        return

    AuthHandler.client_id = client_id

    server_address = ('', 8088)
    httpd = HTTPServer(server_address, AuthHandler)
    
    auth_params = {
        'client_id': client_id,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': 'openid email profile',
        'code_challenge': code_challenge,
        'code_challenge_method': 'S256'
    }
    
    auth_url = f"https://login.alliplatform.com/authorize?{urllib.parse.urlencode(auth_params)}"
    
    print(f"Starting local server to handle callback on {REDIRECT_URI}...")
    print("Opening browser for authorization...")
    webbrowser.open(auth_url)
    
    # Run the server to wait for callback
    httpd.serve_forever()
    print("Server shut down.")

if __name__ == '__main__':
    main()
