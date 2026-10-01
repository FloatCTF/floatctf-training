#include <stdio.h>
#include <string.h>

int main(void) {
    char buf[8];
    strcpy(buf, "nc");
    buf[2] = '!';
    buf[3] = '\0';
    printf("%s\n", buf);
    buf[1] = '\0';
    printf("%s\n", buf);
    return 0;
}
