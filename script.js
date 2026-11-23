/* Get references to the page elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const productSearch = document.getElementById("productSearch");
const clearSelectedButton = document.getElementById("clearSelected");
const rtlToggle = document.getElementById("rtlToggle");

/* Replace this with the Cloudflare Worker URL provided for the project */
const workerUrl = "https://wanderbot-worker.adrianp14business.workers.dev";

let allProducts = [];
let selectedProducts = [];
let messages = [
  {
    role: "system",
    content:
      "You are a warm, concise L'Oréal beauty and skincare advisor. Use only the selected products and their descriptions when building routines. Use web search for current product details or when a user asks for up-to-date beauty information, and cite the sources. For routine requests, include every selected product, explain the order and when to use each, and keep the complete answer under 150 words in plain text without Markdown. Finish every sentence. Ask one short follow-up question if important details such as skin type or goals are missing. Do not diagnose medical conditions or claim guaranteed results.",
  },
];

/* Show a helpful message before the user chooses a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load products from the local JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  allProducts = data.products;
  selectedProducts = loadSavedProducts();
  return allProducts;
}

/* Load saved product selections from the browser */
function loadSavedProducts() {
  const savedIds = JSON.parse(localStorage.getItem("lorealSelectedProducts")) || [];
  return savedIds
    .map((id) => allProducts.find((product) => product.id === id))
    .filter((product) => product);
}

/* Save selected product IDs so they remain after a reload */
function saveSelectedProducts() {
  const selectedIds = selectedProducts.map((product) => product.id);
  localStorage.setItem("lorealSelectedProducts", JSON.stringify(selectedIds));
}

/* Display the products in the selected category */
function displayProducts(products) {
  if (products.length === 0) {
    productsContainer.innerHTML =
      '<div class="placeholder-message">No products found</div>';
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.some(
        (selected) => selected.id === product.id
      );

      return `
        <div
          class="product-card${isSelected ? " selected" : ""}"
          data-product-id="${product.id}"
          role="button"
          tabindex="0"
          aria-pressed="${isSelected}"
        >
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <span class="product-name">${product.name}</span>
            <span class="product-brand">${product.brand}</span>
            <button class="description-toggle" type="button" aria-expanded="false">
              View details
            </button>
            <p class="product-description" hidden>${product.description}</p>
          </div>
          <span class="selection-check" aria-hidden="true">
            <i class="fa-solid fa-check"></i>
          </span>
        </div>
      `;
    })
    .join("");

  /* Add a click listener to every product card */
  const productCards = document.querySelectorAll(".product-card");
  productCards.forEach((card) => {
    const selectCard = () => {
      const productId = Number(card.dataset.productId);
      toggleProduct(productId);
    };

    card.addEventListener("click", (event) => {
      if (!event.target.closest(".description-toggle")) {
        selectCard();
      }
    });

    card.addEventListener("keydown", (event) => {
      if (event.target.closest(".description-toggle")) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectCard();
      }
    });

    const descriptionToggle = card.querySelector(".description-toggle");
    const description = card.querySelector(".product-description");
    descriptionToggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const isHidden = description.hidden;
      description.hidden = !isHidden;
      descriptionToggle.textContent = isHidden ? "Hide details" : "View details";
      descriptionToggle.setAttribute("aria-expanded", String(isHidden));
    });
  });
}

/* Add or remove a product from the selected products list */
function toggleProduct(productId) {
  const product = allProducts.find((item) => item.id === productId);
  const alreadySelected = selectedProducts.some((item) => item.id === productId);

  if (alreadySelected) {
    selectedProducts = selectedProducts.filter((item) => item.id !== productId);
  } else if (product) {
    selectedProducts.push(product);
  }

  saveSelectedProducts();
  updateSelectedProducts();
  filterAndDisplayProducts();
}

/* Show selected products and remove buttons */
function updateSelectedProducts() {
  if (selectedProducts.length === 0) {
    selectedProductsList.innerHTML =
      '<p class="empty-selection">Choose products to build your routine</p>';
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <button
          class="selected-chip"
          type="button"
          data-product-id="${product.id}"
          aria-label="Remove ${product.name}"
        >
          ${product.name}
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      `
    )
    .join("");

  const chips = document.querySelectorAll(".selected-chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      toggleProduct(Number(chip.dataset.productId));
    });
  });
}

/* Send a message to the Cloudflare Worker */
async function getAIResponse() {
  const response = await fetch(workerUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages }),
  });

  if (!response.ok) {
    throw new Error("The routine service is unavailable.");
  }

  const data = await response.json();
  if (
    !data.choices ||
    !data.choices[0] ||
    !data.choices[0].message ||
    typeof data.choices[0].message.content !== "string"
  ) {
    throw new Error("The routine service returned an invalid response.");
  }

  return {
    content: data.choices[0].message.content,
    citations: Array.isArray(data.citations) ? data.citations : [],
  };
}

/* Add a message bubble to the chat window */
function addChatMessage(role, content, citations = []) {
  const message = document.createElement("div");
  message.className = `chat-message ${role}`;
  message.textContent = content;

  const safeCitations = citations.filter(
    (citation) =>
      citation &&
      typeof citation.url === "string" &&
      citation.url.startsWith("https://")
  );

  if (role === "assistant" && safeCitations.length > 0) {
    const sources = document.createElement("div");
    sources.className = "citation-links";

    const heading = document.createElement("strong");
    heading.textContent = "Sources";
    sources.appendChild(heading);

    const list = document.createElement("ul");
    safeCitations.forEach((citation, index) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = citation.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = citation.title || `Source ${index + 1}`;
      item.appendChild(link);
      list.appendChild(item);
    });

    sources.appendChild(list);
    message.appendChild(sources);
  }

  chatWindow.appendChild(message);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Filter products when the category changes */
categoryFilter.addEventListener("change", async (e) => {
  if (allProducts.length === 0) {
    await loadProducts();
  }
  filterAndDisplayProducts();
});

/* Combine the category and search filters */
function filterAndDisplayProducts() {
  const selectedCategory = categoryFilter.value;
  const searchText = productSearch.value.trim().toLowerCase();

  const filteredProducts = allProducts.filter((product) => {
    const matchesCategory =
      !selectedCategory || product.category === selectedCategory;
    const searchableText =
      `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
    const matchesSearch = !searchText || searchableText.includes(searchText);
    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

/* Search products as the user types */
productSearch.addEventListener("input", filterAndDisplayProducts);

/* Remove every saved product selection */
clearSelectedButton.addEventListener("click", () => {
  selectedProducts = [];
  saveSelectedProducts();
  updateSelectedProducts();
  filterAndDisplayProducts();
});

/* Toggle a right-to-left page layout for RTL languages */
rtlToggle.addEventListener("click", () => {
  const isRtl = document.body.classList.toggle("rtl");
  rtlToggle.setAttribute("aria-pressed", String(isRtl));
  document.documentElement.setAttribute("dir", isRtl ? "rtl" : "ltr");
});

/* Generate a routine from the selected products */
generateRoutineButton.addEventListener("click", async () => {
  if (selectedProducts.length === 0) {
    addChatMessage("assistant", "Select at least one product first.");
    return;
  }

  const selectedProductData = selectedProducts.map((product) => ({
    name: product.name,
    brand: product.brand,
    category: product.category,
    description: product.description,
  }));

  const userMessage =
    "Create a complete, concise routine using only these selected products. " +
    "Mention every selected product, explain the order and when to use each, " +
    "and write in plain text without Markdown.\n\n" +
    "Selected products (JSON):\n" +
    JSON.stringify(selectedProductData, null, 2);

  messages.push({ role: "user", content: userMessage });
  addChatMessage("assistant", "Building your routine...");
  generateRoutineButton.disabled = true;

  try {
    const result = await getAIResponse();
    chatWindow.lastElementChild.remove();
    addChatMessage("assistant", result.content, result.citations);
    messages.push({ role: "assistant", content: result.content });
  } catch (error) {
    chatWindow.lastElementChild.remove();
    addChatMessage(
      "assistant",
      "I couldn't connect to the routine service. Please try again later."
    );
  } finally {
    generateRoutineButton.disabled = false;
  }
});

/* Send follow-up questions while keeping conversation history */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const text = userInput.value.trim();
  if (text === "") return;

  addChatMessage("user", text);
  messages.push({ role: "user", content: text });
  userInput.value = "";

  addChatMessage("assistant", "Thinking...");

  try {
    const result = await getAIResponse();
    chatWindow.lastElementChild.remove();
    addChatMessage("assistant", result.content, result.citations);
    messages.push({ role: "assistant", content: result.content });
  } catch (error) {
    chatWindow.lastElementChild.remove();
    addChatMessage(
      "assistant",
      "I couldn't connect to the routine service. Please try again later."
    );
  }
});

/* Initialize the page */
async function initializePage() {
  await loadProducts();
  updateSelectedProducts();
  filterAndDisplayProducts();
}

initializePage();
