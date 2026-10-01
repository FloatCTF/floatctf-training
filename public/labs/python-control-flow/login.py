secret = "kali123"
tries = 0
while tries < 3:
    guess = input("password: ")
    if guess == secret:
        print("welcome")
        break
    tries = tries + 1
    print("wrong,", 3 - tries, "left")
if tries == 3:
    print("locked")
