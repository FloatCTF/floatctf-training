#include <stdio.h>
#include <string.h>

int main(void) {
    char buf[8];
    strcpy(buf, "this string is far too long");
    printf("%s\n", buf);
    return 0;
}
