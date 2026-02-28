from collections import deque

def get_value_bfs(data, target_key):
    queue = deque([data])
    while queue:
        current = queue.popleft()
        if isinstance(current, dict):
            for key, value in current.items():
                if key == target_key:
                    return value
                if isinstance(value, (dict, list)):
                    queue.append(value)
        elif isinstance(current, list):
            for item in current:
                if isinstance(item, (dict, list)):
                    queue.append(item)

    return None
