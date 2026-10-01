let count = 0;

function handleClick() {
  count = count + 1;
  document.querySelector("#count").textContent = count;
}

document.querySelector("#add").addEventListener("click", handleClick);

async function loadItems() {
  const response = await fetch("/api/items?page=1");
  const data = await response.json();
  for (const item of data.items) {
    const li = document.createElement("li");
    li.textContent = item.name + " - " + item.price;
    document.querySelector("#items").appendChild(li);
  }
}

document.querySelector("#load").addEventListener("click", loadItems);

async function tryFetch(url) {
  try {
    const response = await fetch(url);
    return "status " + response.status;
  } catch (error) {
    return "blocked: " + error.message;
  }
}
