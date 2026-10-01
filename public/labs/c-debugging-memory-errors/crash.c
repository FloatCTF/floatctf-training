#include <stdio.h>
#include <string.h>

int name_length(const char *name) {
    return strlen(name);
}

void greet(const char *name) {
    int length = name_length(name);
    printf("hello, %s (%d)\n", name, length);
}

int main(void) {
    const char *names[3] = {"alice", "bob", NULL};
    for (int i = 0; i < 3; i++) {
        greet(names[i]);
    }
    return 0;
}
