#include <stdio.h>

int *make(void) {
    int value = 42;
    return &value;
}

int main(void) {
    int *p = make();
    printf("%d\n", *p);
    return 0;
}
