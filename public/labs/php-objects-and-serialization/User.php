<?php
class User
{
    public function __construct(
        public string $name,
        private int $level = 1,
    ) {
    }

    public function promote(): void
    {
        $this->level = $this->level + 1;
    }

    public function level(): int
    {
        return $this->level;
    }

    public function __toString(): string
    {
        return "$this->name (level $this->level)";
    }
}
