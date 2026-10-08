<?php
class Visit
{
    public function __construct(public string $page)
    {
        echo "start $page\n";
    }

    public function __destruct()
    {
        echo "end $this->page\n";
    }
}

function show(): void
{
    $v = new Visit('index');
    echo "showing\n";
}

show();
echo "back in main\n";
