import {createHandler} from './core.js';
import {createAssistant} from './assistant.js';
const env=(name:string)=>Deno.env.get(name);Deno.serve(createAssistant({env,paid:true,base:createHandler({env,paid:true})}));
