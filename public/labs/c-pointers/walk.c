#include <stdio.h>

int main(void) {
    int ports[3] = {22, 80, 443};
    int *p = ports;
    printf("%d %d\n", ports[1], *(p + 1));
    p = p + 2;
    printf("%d\n", *p);
    *p = 8443;
    printf("%d\n", ports[2]);
    return 0;
}
