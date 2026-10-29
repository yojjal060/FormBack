const sections=[...document.querySelectorAll('.step')];
const form=document.querySelector('#test-form');
const key='formback-test-step';
let step=Math.min(3,Math.max(0,Number(sessionStorage.getItem(key)||0)));
function render(){sections.forEach((el,i)=>el.hidden=i!==step);form.setAttribute('data-formback-step',String(step+1));document.querySelector('#step-label').textContent=`Step ${Math.min(step+1,3)} of 3`;document.querySelector('#back').hidden=step===0;document.querySelector('#next').textContent=step===3?'Done':'Next →';}
document.querySelector('#next').addEventListener('click',()=>{const invalid=sections[step].querySelector(':invalid');if(invalid){invalid.reportValidity();return}window.dispatchEvent(new Event('formback-test-checkpoint'));step=Math.min(3,step+1);sessionStorage.setItem(key,step);render();});
document.querySelector('#back').addEventListener('click',()=>{window.dispatchEvent(new Event('formback-test-checkpoint'));step=Math.max(0,step-1);sessionStorage.setItem(key,step);render();});
document.querySelector('#reload').addEventListener('click',()=>location.reload());
render();
