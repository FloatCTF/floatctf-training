#include <stdio.h>
#include <string.h>

int main(void) {
    char name[] = "kali";
    printf("%s\n", name);
    printf("%zu %zu\n", sizeof(name), strlen(name));
    name[0] = 'K';
    printf("%s\n", name);
    for (int i = 0; name[i] != '\0'; i++) {
        printf("%c=%d ", name[i], name[i]);
    }
    printf("\n");
    return 0;
}
