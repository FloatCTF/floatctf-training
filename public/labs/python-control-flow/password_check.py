password = input("password: ")
if len(password) < 8:
    print("too short")
elif password == "12345678":
    print("too common")
else:
    print("ok")
