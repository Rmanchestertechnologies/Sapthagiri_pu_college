export const exportToWord = (elementSelector, filename = 'document.pdf', settings = {}) => {
    // Strictly PDF Output requirement: Enforce window.print PDF rendering
    window.print();
};

