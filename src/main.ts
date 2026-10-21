import './style.css';

const canvas = document.querySelector<HTMLCanvasElement>('#garden');
if (!canvas) throw new Error('missing #garden canvas');
