// Phone entry routing only; resizing a desktop window must not switch layouts.
// The dedicated mobile document also works when opened directly on a computer.
if (document.documentElement.dataset.layout !== 'mobile') {
  const phone = navigator.userAgentData?.mobile === true || /Android.*Mobile|iPhone|iPod|Windows Phone/i.test(navigator.userAgent);
  if (phone) {
    const target = new URL('./mobile.html', document.baseURI);
    target.search = location.search;
    target.hash = location.hash;
    location.replace(target.href);
  }
}
