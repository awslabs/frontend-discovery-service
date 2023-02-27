export class ImportsMapGenerator {
  constructor() {
    this.imports = [];
  }

  addImport(id, url) {
    this.imports.push({ id, url });
  }

  async appendToHead() {
    const originalScript = document.getElementById("map");
    const theMap = JSON.parse(originalScript.textContent);

    let id, i;
    for (i in this.imports) {
      id = `@${this.imports[i].id}`;
      theMap.imports[id] = this.imports[i].url;
    }

    const script = document.createElement("script");
    script.type = "systemjs-importmap";
    script.textContent = JSON.stringify(theMap);
    document.head.appendChild(script);
  }
}
