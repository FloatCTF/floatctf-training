def parse_status(line):
    parts = line.split()
    return int(parts[8])

def main():
    print(parse_status('192.0.2.10 - - [01/Oct/2026:09:12:01 +0800] "GET / HTTP/1.1" 200 5123'))
    print(parse_status("broken line"))

main()
