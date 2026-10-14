// Keep PDF text extraction compatible with Safari versions before Promise.withResolvers.
if(!Promise.withResolvers)Promise.withResolvers=function(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
const {WorkerMessageHandler}=await import('./pdf-worker-4.10.38.mjs');
export {WorkerMessageHandler};
