/** Add a visible, accessible eye button beside each owner registration password.
 * The input element is moved, not recreated: values, browser autofill and
 * the existing form handlers are preserved.
 */
export function attachPasswordVisibility(root=document){
 const inputs=root.querySelectorAll('input[type="password"]');
 for(const input of inputs){
  if(input.closest('.bn-password-field'))continue;
  const wrapper=document.createElement('span');
  wrapper.className='bn-password-field';
  const button=document.createElement('button');
  button.type='button';
  button.className='bn-password-toggle';
  button.setAttribute('aria-pressed','false');
  const isConfirmation=input.name==='confirmPassword'||input.name==='confirm_password';
  const fieldLabel=isConfirmation?'confirmación de contraseña':'contraseña';
  function update(){
   const visible=input.type==='text';
   const label=(visible?'Ocultar ':'Mostrar ')+fieldLabel;
   button.setAttribute('aria-label',label);
   button.setAttribute('title',label);
   button.setAttribute('aria-pressed',String(visible));
   button.innerHTML=visible
     ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.7 5.1A10.6 10.6 0 0 1 12 5c6.4 0 10 7 10 7a17.2 17.2 0 0 1-4.1 4.9M6.2 6.2C3.5 8.1 2 12 2 12s3.6 7 10 7c1.4 0 2.7-.3 3.9-.9"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>'
     : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
  }
  input.parentNode.insertBefore(wrapper,input);
  wrapper.appendChild(input);
  wrapper.appendChild(button);
  button.addEventListener('click',()=>{
   input.type=input.type==='password'?'text':'password';
   update();
  });
  update();
 }
}

[executed on device: vmi3669516 (22a9c8cd-8866-4186-9071-dab9301dff16)]