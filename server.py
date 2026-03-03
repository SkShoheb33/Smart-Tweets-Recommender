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
                
                def get_val(key, env_key):
                    val = data.get(key)
                    if not val:
                        val = os.getenv(env_key)
                    return val

                config = {
                    "auth_bearer": get_val('auth_bearer', 'AUTH_BEARER_TOKEN'),
                    "auth_token": get_val('auth_token', 'AUTH_TOKEN'),
                    "csrf_token": get_val('csrf_token', 'CSRF_TOKEN'),
                    "guest_id": get_val('guest_id', 'GUEST_ID'),
                    "twid": get_val('twid', 'TWITTER_ID'),
                    "cf_bm_cookie": get_val('cf_bm_cookie', 'CF_BM_COOKIE'),
                    "client_transaction_id": get_val('client_transaction_id', 'CLIENT_TRANSACTION_ID'),
                    "user_agent": get_val('user_agent', 'USER_AGENT') or 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                    "google_api_key": get_val('google_api_key', 'GOOGLE_API_KEY')
                }
                
                from tweets_recommender.agent import run_agent
                
                # Set up Server-Sent Events headers
                self.send_response(200)
                self.send_header('Content-Type', 'text/event-stream')
                self.send_header('Cache-Control', 'no-cache')
                self.send_header('Connection', 'keep-alive')
                self.end_headers()

                def status_callback(msg):
                    try:
                        self.wfile.write(f"data: {json.dumps({'status': msg})}\n\n".encode('utf-8'))
                        self.wfile.flush()
                    except Exception as e:
                        print(f"Error sending SSE: {e}")

                final_state = run_agent(config, status_callback=status_callback)
                
                state_to_return = {k: v for k, v in final_state.items() if k != 'config'}
                
                # Send final result
                try:
                    self.wfile.write(f"data: {json.dumps({'status': 'Done', 'result': state_to_return})}\n\n".encode('utf-8'))
                    self.wfile.flush()
                except Exception as e:
                    print(f"Error sending final SSE: {e}")
                
            except Exception as e:
                print(f"Error running agent: {e}")
                try:
                    self.wfile.write(f"data: {json.dumps({'error': str(e)})}\n\n".encode('utf-8'))
                    self.wfile.flush()
                except:
                    pass
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