import { useEffect, useState } from 'react';
import { getAllProducts, addProduct, updateProduct, deleteProduct } from '../lib/db';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [name, setName] = useState('');
  const [gebindeLabel, setGebindeLabel] = useState('');
  const [gebindeUnits, setGebindeUnits] = useState('');
  const [gebindeList, setGebindeList] = useState([]);
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const all = await getAllProducts();
    setProducts(all.sort((a, b) => a.name.localeCompare(b.name)));
  }

  function addGebindeToList() {
    if (!gebindeLabel.trim() || !gebindeUnits) return;
    setGebindeList([...gebindeList, { label: gebindeLabel.trim(), units: Number(gebindeUnits) }]);
    setGebindeLabel('');
    setGebindeUnits('');
  }

  function removeGebinde(idx) {
    setGebindeList(gebindeList.filter((_, i) => i !== idx));
  }

  async function saveProduct() {
    if (!name.trim()) return;
    const product = { name: name.trim(), gebinde: gebindeList };
    if (editingId) {
      await updateProduct({ id: editingId, ...product });
    } else {
      await addProduct(product);
    }
    resetForm();
    load();
  }

  function editProduct(p) {
    setEditingId(p.id);
    setName(p.name);
    setGebindeList(p.gebinde || []);
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setGebindeList([]);
    setGebindeLabel('');
    setGebindeUnits('');
  }

  async function remove(id) {
    if (confirm('Produkt wirklich löschen?')) {
      await deleteProduct(id);
      load();
    }
  }

  return (
    <div className="page">
      <h1>Produktpalette</h1>

      <div className="card">
        <h2>{editingId ? 'Produkt bearbeiten' : 'Neues Produkt'}</h2>
        <input
          className="input"
          placeholder="Produktname, z.B. Red Bull"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="gebinde-add">
          <input
            className="input small"
            placeholder="Gebinde-Name, z.B. Trag(l) 24er"
            value={gebindeLabel}
            onChange={(e) => setGebindeLabel(e.target.value)}
          />
          <input
            className="input small"
            type="number"
            placeholder="Stk."
            value={gebindeUnits}
            onChange={(e) => setGebindeUnits(e.target.value)}
          />
          <button className="btn-secondary" onClick={addGebindeToList}>
            + Gebinde
          </button>
        </div>

        {gebindeList.length > 0 && (
          <ul className="gebinde-list">
            {gebindeList.map((g, i) => (
              <li key={i}>
                {g.label} ({g.units} Stk.)
                <button className="btn-link" onClick={() => removeGebinde(i)}>
                  entfernen
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="row">
          <button className="btn-primary" onClick={saveProduct}>
            {editingId ? 'Speichern' : 'Produkt hinzufügen'}
          </button>
          {editingId && (
            <button className="btn-secondary" onClick={resetForm}>
              Abbrechen
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Alle Produkte ({products.length})</h2>
        <ul className="product-list">
          {products.map((p) => (
            <li key={p.id}>
              <div>
                <strong>{p.name}</strong>
                {p.gebinde?.length > 0 && (
                  <span className="muted">
                    {' '}
                    — {p.gebinde.map((g) => `${g.label} (${g.units})`).join(', ')}
                  </span>
                )}
              </div>
              <div>
                <button className="btn-link" onClick={() => editProduct(p)}>
                  Bearbeiten
                </button>
                <button className="btn-link danger" onClick={() => remove(p.id)}>
                  Löschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
