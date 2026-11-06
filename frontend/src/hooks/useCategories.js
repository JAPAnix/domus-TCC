import { useEffect, useState } from 'react';
import api from '../services/api';

let cached = null;

/** Categorias do banco, buscadas uma vez por sessão. Falhas podem ser tentadas de novo. */
export function useCategories() {
  const [state, setState] = useState({ categories: [], failed: false });

  useEffect(() => {
    let active = true;
    cached ??= api.get('/categories').then(({ data }) => data).catch((error) => { cached = null; throw error; });
    cached.then((categories) => { if (active) setState({ categories, failed: false }); })
      .catch(() => { if (active) setState({ categories: [], failed: true }); });
    return () => { active = false; };
  }, []);

  return state;
}
