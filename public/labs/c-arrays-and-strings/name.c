#include <stdio.h>
#include <string.h>

int main(void) {
    char name[8];
    printf("name: ");
    fgets(name, sizeof(name), stdin);
    name[strcspn(name, "\n")] = '\0';
    printf("hello, %s (%zu)\n", name, strlen(name));
    return 0;
}
