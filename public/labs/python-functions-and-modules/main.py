import checks

password = input("password: ")
if checks.is_strong(password):
    print("ok")
else:
    print("too short")
