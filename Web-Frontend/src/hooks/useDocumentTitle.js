//for Tab title

import { useEffect } from 'react';

function useDocumentTitle(suffix) {
  useEffect(() => {
    const baseTitle = 'Alerto+';
    document.title = suffix ? `${baseTitle} | ${suffix}` : baseTitle;
  }, [suffix]);
}

export default useDocumentTitle;
