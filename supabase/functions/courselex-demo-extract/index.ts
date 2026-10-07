import { createHandler } from './core.js';
Deno.serve(createHandler({env:name=>Deno.env.get(name)}));
