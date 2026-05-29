import os
import urllib.parse
import webbrowser
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
import requests
from dotenv import load_dotenv, set_key

# Load environment variables
dotenv_path = os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', '..', '.env')
load_dotenv(dotenv_path)

CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')

# Using HTTP, Google allows http://127.0.0.1 for local testing without SSL
REDIRECT_URI = 'http://127.0.0.1:8088/googlecallback'

# Scopes for Gmail, Sheets, Docs, Drive, Calendar, and UserInfo
SCOPES = [
    'https://mail.google.com/',
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/userinfo.email',
]
SCOPE = ' '.join(SCOPES)

if not CLIENT_ID or not CLIENT_SECRET:
    print("Error: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not found in .env file.")
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
            token_url = "https://oauth2.googleapis.com/token"
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
                    set_key(dotenv_path, 'GOOGLE_REFRESH_TOKEN', refresh_token)
                    print("Successfully retrieved and saved GOOGLE_REFRESH_TOKEN to .env")
                    self.wfile.write(b"<html><body><h1>Authorization Successful!</h1><p>You can close this window now.</p><script>window.close();</script></body></html>")
                else:
                    if access_token:
                        print("Got access token but no refresh token. Make sure you haven't authorized this app previously without revoking, or assure access_type=offline and prompt=consent.")
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
    server_address = ('', 8088)
    httpd = HTTPServer(server_address, AuthHandler)
    
    # Construct auth URL
    # access_type='offline' and prompt='consent' ensure a refresh_token is returned
    auth_params = {
        'client_id': CLIENT_ID,
        'redirect_uri': REDIRECT_URI,
        'response_type': 'code',
        'scope': SCOPE,
        'access_type': 'offline',
        'prompt': 'consent'
    }
    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(auth_params)}"
    
    print(f"Starting local server to handle callback on {REDIRECT_URI}...")
    print("Opening browser for authorization...")
    webbrowser.open(auth_url)
    
    # Run the server to wait for callback
    httpd.serve_forever()
    print("Server shut down.")

if __name__ == '__main__':
    main()
