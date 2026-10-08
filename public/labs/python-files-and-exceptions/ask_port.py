while True:
    text = input("port: ")
    try:
        port = int(text)
    except ValueError:
        print("please enter a number")
        continue
    print("ok:", port)
    break
