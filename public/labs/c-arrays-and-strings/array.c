#include <stdio.h>

int main(void) {
    int ports[4] = {22, 53, 80, 443};
    int total = 0;
    for (int i = 0; i < 4; i++) {
        total = total + ports[i];
    }
    printf("%d\n", total);
    printf("%zu %zu\n", sizeof(ports), sizeof(ports[0]));
    ports[1] = 8080;
    printf("%d\n", ports[1]);
    return 0;
}
