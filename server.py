import http.server
import socketserver
import os
import sys
import json
from dotenv import load_dotenv

load_dotenv()

PORT = 8000

class CORSRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'X-Requested-With, Content-Type')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        return super(CORSRequestHandler, self).end_headers()

    def do_OPTIONS(self):
        self.send_response(200, "ok")
        self.end_headers()

    def do_POST(self):
        if self.path == '/run_agent':
            content_length = int(self.headers.get('Content-Length', 0))
            if content_length > 0:
                post_data = self.rfile.read(content_length)
                try:
                    data = json.loads(post_data)
                except json.JSONDecodeError:
                    data = {}
            else:
                data = {}
            
            try:
                print(f"Received data keys: {data.keys()}")
                
                # Helper function to prefer valid non-empty data strings, then fallback to env
                def get_val(key, env_key):
                    val = data.get(key)
                    if not val: # handles None and "" (empty string)
                        val = os.getenv(env_key)
                    return val

                # We need to construct the config to pass to the agent
                # Fallback to os.getenv if the client doesn't provide it
                # Make sure to handle empty strings from frontend like we handle None
                config = {
                    "auth_bearer": get_val('auth_bearer', 'AUTH_BEARER_TOKEN'),
                    "auth_token": get_val('auth_token', 'AUTH_TOKEN'),
                    "csrf_token": get_val('csrf_token', 'CSRF_TOKEN'),
                    "guest_id": get_val('guest_id', 'GUEST_ID'),
                    "twid": get_val('twid', 'TWITTER_ID'),
                    "cf_bm_cookie": get_val('cf_bm_cookie', 'CF_BM_COOKIE'),
                    "client_transaction_id": get_val('client_transaction_id', 'CLIENT_TRANSACTION_ID'),
                    "user_agent": get_val('user_agent', 'USER_AGENT') or 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36'
                }
                
                print("Config auth token:", config.get("auth_token")[:5] if config.get("auth_token") else "None")
                print("Config csrf token:", config.get("csrf_token")[:5] if config.get("csrf_token") else "None")
                print("Config guest id:", config.get("guest_id")[:5] if config.get("guest_id") else "None")
                print("Config twid:", config.get("twid")[:5] if config.get("twid") else "None")
                print("Config auth_bearer:", config.get("auth_bearer")[:15] if config.get("auth_bearer") else "None")

                
                # Import here to avoid circular imports if any, and only load agent when needed
                from agent import run_agent
                
                # Run the agent with the dynamically provided config
                final_state = run_agent(config)
                
                # We don't want to return the config back to the client
                state_to_return = {k: v for k, v in final_state.items() if k != 'config'}
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(state_to_return).encode('utf-8'))
                
            except Exception as e:
                print(f"Error running agent: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

if __name__ == "__main__":
    # Ensure we are in the root directory so we can serve 'data/data.json'
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    with socketserver.TCPServer(("", PORT), CORSRequestHandler) as httpd:
        print(f"Server started at http://localhost:{PORT}")
        print("Keep this running to allow the Chrome Extension to fetch recommendations.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            sys.exit(0)