
const state = {
  products: [],
  cart: JSON.parse(localStorage.getItem("autoforge-cart") || "{}"),
  q: "",
  category: ""
};

const $ = s => document.querySelector(s);
const money = n => new Intl.NumberFormat("ro-RO", { style: "currency", currency: "RON" }).format(Number(n));

const categoryIcons = {
  "Filtre":"🧰","Frâne":"🛑","Motor":"⚙️","Electrică":"🔋","Iluminare":"💡","Suspensie":"🛞"
};

function saveCart() {
  localStorage.setItem("autoforge-cart", JSON.stringify(state.cart));
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 1800);
}

async function init() {
  try {
    state.products = await fetch("/api/products").then(r => {
      if (!r.ok) throw new Error("API");
      return r.json();
    });
    renderCategories();
    renderProducts();
    renderCart();
  } catch {
    $("#productsGrid").innerHTML = "<p>Produsele nu au putut fi încărcate. Verifică baza de date.</p>";
  }
}

function renderCategories() {
  const cats = [...new Set(state.products.map(p => p.category))];
  $("#categories").innerHTML = cats.map(c => `
    <button class="category" data-category="${c}">
      <span class="emoji">${categoryIcons[c] || "🔧"}</span>
      <b>${c}</b>
    </button>`).join("");

  const sel = $("#categoryFilter");
  cats.forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c; sel.appendChild(o);
  });

  document.querySelectorAll(".category").forEach(b => b.onclick = () => {
    state.category = b.dataset.category;
    $("#categoryFilter").value = state.category;
    renderProducts();
    document.querySelector("#products").scrollIntoView({behavior:"smooth"});
  });
}

function renderProducts() {
  const q = state.q.toLowerCase().trim();
  const list = state.products.filter(p =>
    (!state.category || p.category === state.category) &&
    (!q || `${p.name} ${p.description} ${p.category}`.toLowerCase().includes(q))
  );

  $("#productsGrid").innerHTML = list.map(p => `
    <article class="product">
      ${p.badge ? `<span class="badge">${p.badge}</span>` : ""}
      <div class="product-img"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
      <div class="product-body">
        <h3>${p.name}</h3>
        <div class="category-name">${p.category}</div>
        <p class="product-desc">${p.description}</p>
        <div class="stock">● ${p.stock > 0 ? `În stoc (${p.stock})` : "Stoc epuizat"}</div>
        <div class="product-row">
          <span class="price">${money(p.price)}</span>
          <button class="add" data-id="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>🛒 Adaugă</button>
        </div>
      </div>
    </article>
  `).join("") || "<p>Nu am găsit produse.</p>";

  document.querySelectorAll(".add").forEach(btn => btn.onclick = () => addToCart(btn.dataset.id));
}

function addToCart(id) {
  const p = state.products.find(x => x.id === id);
  if (!p) return;
  const current = state.cart[id] || 0;
  if (current >= p.stock) return toast("Ai atins stocul disponibil.");
  state.cart[id] = current + 1;
  saveCart(); renderCart(); toast("Produs adăugat în coș.");
}

function changeQty(id, delta) {
  const p = state.products.find(x => x.id === id);
  let qty = (state.cart[id] || 0) + delta;
  if (p) qty = Math.min(qty, p.stock);
  if (qty <= 0) delete state.cart[id]; else state.cart[id] = qty;
  saveCart(); renderCart();
}

function renderCart() {
  const entries = Object.entries(state.cart);
  let total = 0, count = 0;

  $("#cartItems").innerHTML = entries.map(([id, qty]) => {
    const p = state.products.find(x => x.id === id);
    if (!p) return "";
    total += Number(p.price) * qty; count += qty;
    return `
      <div class="cart-item">
        <img src="${p.image}" alt="${p.name}">
        <div>
          <b>${p.name}</b><br>
          <small>${money(p.price)} / buc.</small>
          <div class="qty">
            <button data-minus="${id}">−</button><span>${qty}</span><button data-plus="${id}">+</button>
          </div>
        </div>
        <button class="remove" data-remove="${id}">Șterge</button>
      </div>`;
  }).join("") || "<p>Coșul este gol.</p>";

  $("#cartTotal").textContent = money(total);
  $("#cartCount").textContent = count;

  document.querySelectorAll("[data-minus]").forEach(b => b.onclick = () => changeQty(b.dataset.minus, -1));
  document.querySelectorAll("[data-plus]").forEach(b => b.onclick = () => changeQty(b.dataset.plus, 1));
  document.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => {
    delete state.cart[b.dataset.remove]; saveCart(); renderCart();
  });
}

function openCart() {
  $("#cartDrawer").classList.add("show");
  $("#overlay").classList.add("show");
}
function closeCart() {
  $("#cartDrawer").classList.remove("show");
  $("#overlay").classList.remove("show");
}

$("#openCart").onclick = openCart;
$("#closeCart").onclick = closeCart;
$("#overlay").onclick = closeCart;

$("#categoryFilter").onchange = e => { state.category = e.target.value; renderProducts(); };
$("#search").oninput = e => { state.q = e.target.value; renderProducts(); };
$("#searchBtn").onclick = () => document.querySelector("#products").scrollIntoView({behavior:"smooth"});

$("#checkoutBtn").onclick = async () => {
  const cart = Object.entries(state.cart).map(([id, qty]) => ({ id, qty }));
  const msg = $("#checkoutMsg");
  if (!cart.length) return toast("Coșul este gol.");

  $("#checkoutBtn").disabled = true;
  msg.textContent = "Se pregătește plata...";
  try {
    const r = await fetch("/api/create-checkout-session", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ cart, phone: $("#checkoutPhone").value })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Eroare");
    window.location.href = data.url;
  } catch (e) {
    msg.textContent = e.message;
    $("#checkoutBtn").disabled = false;
  }
};

init();
