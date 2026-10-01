#include <stdio.h>
#include <string.h>

struct user {
    char name[8];
    int level;
};

void promote(struct user *u) {
    u->level = u->level + 1;
}

int main(void) {
    struct user alice;
    strcpy(alice.name, "alice");
    alice.level = 1;
    promote(&alice);
    printf("%s %d\n", alice.name, alice.level);
    printf("%zu\n", sizeof(struct user));
    return 0;
}
