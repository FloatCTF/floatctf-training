#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *duplicate(const char *text) {
    char *copy = malloc(strlen(text));
    strcpy(copy, text);
    return copy;
}

int main(void) {
    char *name = duplicate("kali");
    printf("%s\n", name);
    free(name);
    return 0;
}
