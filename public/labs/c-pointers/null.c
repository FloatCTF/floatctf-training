#include <stdio.h>

int main(void) {
    int *p = NULL;
    printf("before\n");
    printf("%d\n", *p);
    printf("after\n");
    return 0;
}
