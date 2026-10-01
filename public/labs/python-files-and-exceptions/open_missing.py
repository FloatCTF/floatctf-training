filename = input("file: ")
try:
    with open(filename) as f:
        print(len(f.readlines()), "lines")
except FileNotFoundError:
    print("no such file:", filename)
