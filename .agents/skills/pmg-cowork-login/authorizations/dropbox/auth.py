import base64
import hashlib
import os
import secrets
import threading
import urllib.parse
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
import requests
from dotenv import load_dotenv, set_key

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)

CLIENT_ID = os.getenv('DROPBOX_CLIENT_ID')
CLIENT_SECRET = os.getenv('DROPBOX_CLIENT_SECRET')

# The requested redirect URI
REDIRECT_URI = 'http://localhost:8085/dropboxcallback'

# Scopes for Dropbox
SCOPES = [
    'account_info.read',
    'files.metadata.write',
    'files.metadata.read',
    'files.content.write',
    'files.content.read',
    'openid',
    'email'
]
SCOPE = ' '.join(SCOPES)

if not CLIENT_ID:
    print("Error: DROPBOX_CLIENT_ID not found in .env file.")
    exit(1)

# Generate PKCE verifier and challenge
def generate_pkce_pair():
    # Generate a high-entropy cryptographically secure string (code_verifier)
    verifier = secrets.token_urlsafe(32)
    
    # Hash the verifier using SHA-256
    digest = hashlib.sha256(verifier.encode('ascii')).digest()
    
    # Base64URL encode the hash without padding (code_challenge)
    challenge = base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')
    
    return verifier, challenge

CODE_VERIFIER, CODE_CHALLENGE = generate_pkce_pair()

class AuthHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        query_components = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        if 'code' in query_components:
            code = query_components['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Exchange code for token
            token_url = "https://api.dropboxapi.com/oauth2/token"
            data = {
                'grant_type': 'authorization_code',
                'client_id': CLIENT_ID,
                'redirect_uri': REDIRECT_URI,
                'code': code,
                'code_verifier': CODE_VERIFIER
            }
            
            if CLIENT_SECRET:
                data['client_secret'] = CLIENT_SECRET
            
            try:
                response = requests.post(token_url, data=data)
                response.raise_for_status()
                token_data = response.json()
                
                access_token = token_data.get('access_token')
                refresh_token = token_data.get('refresh_token')
                
                if refresh_token:
                    set_key(dotenv_path, 'DROPBOX_REFRESH_TOKEN', refresh_token)
                    print("Successfully retrieved and saved DROPBOX_REFRESH_TOKEN to .env")
                    self.wfile.write(b"<html><body><h1>Authorization Successful!</h1><p>You can close this window now.</p><script>window.close();</script></body></html>")
                else:
                    if access_token:
                        print("Got access token but no refresh token. Make sure you haven't authorized this app previously without revoking, or assure token_access_type=offline.")
                    print("Failed to get refresh token from response.")
                    print(token_data)
                    self.wfile.write(b"<html><body><h1>Authorization Completed without Refresh Token</h1><p>See terminal for details.</p></body></html>")
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
    server_address = ('', 8085)
    httpd = HTTPServer(server_address, AuthHandler)
    
    # Construct auth URL
    # token_access_type='offline' ensures a refresh_token is returned
    auth_params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'token_access_type': 'offline',
        'code_challenge': CODE_CHALLENGE,
        'code_challenge_method': 'S256',
        'scope': SCOPE
    }
    auth_url = f"https://www.dropbox.com/oauth2/authorize?{urllib.parse.urlencode(auth_params)}"
    
    print(f"Starting local server to handle callback on {REDIRECT_URI}...")
    print("Opening browser for authorization...")
    webbrowser.open(auth_url)
    
    # Run the server to wait for callback
    httpd.serve_forever()
    print("Server shut down.")

if __name__ == '__main__':
    main()
