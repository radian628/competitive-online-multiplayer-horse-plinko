import * as process from "node:process";
import * as esbuild from "esbuild";
import * as path from "node:path";
import * as fs from "node:fs";
import { lessLoader } from "esbuild-plugin-less";
import { copy } from "esbuild-plugin-copy";

const dev = process.argv.includes("dev");

let wasmPlugin = {
  name: "wasm",
  setup(build) {
    // Resolve ".wasm" files to a path with a namespace
    build.onResolve({ filter: /\.wasm$/ }, (args) => {
      // If this is the import inside the stub module, import the
      // binary itself. Put the path in the "wasm-binary" namespace
      // to tell our binary load callback to load the binary file.
      if (args.namespace === "wasm-stub") {
        return {
          path: args.path,
          namespace: "wasm-binary",
        };
      }

      // Otherwise, generate the JavaScript stub module for this
      // ".wasm" file. Put it in the "wasm-stub" namespace to tell
      // our stub load callback to fill it with JavaScript.
      //
      // Resolve relative paths to absolute paths here since this
      // resolve callback is given "resolveDir", the directory to
      // resolve imports against.
      if (args.resolveDir === "") {
        return; // Ignore unresolvable paths
      }
      return {
        path: path.isAbsolute(args.path)
          ? args.path
          : path.join(args.resolveDir, args.path),
        namespace: "wasm-stub",
      };
    });

    // Virtual modules in the "wasm-stub" namespace are filled with
    // the JavaScript code for compiling the WebAssembly binary. The
    // binary itself is imported from a second virtual module.
    build.onLoad({ filter: /.*/, namespace: "wasm-stub" }, async (args) => ({
      contents: `import wasm from ${JSON.stringify(args.path)}
        export default (imports) =>
          WebAssembly.instantiate(wasm, imports).then(
            result => result.instance.exports)`,
    }));

    // Virtual modules in the "wasm-binary" namespace contain the
    // actual bytes of the WebAssembly file. This uses esbuild's
    // built-in "binary" loader instead of manually embedding the
    // binary data inside JavaScript code ourselves.
    build.onLoad({ filter: /.*/, namespace: "wasm-binary" }, async (args) => ({
      contents: await fs.promises.readFile(args.path),
      loader: "binary",
    }));
  },
};

const ctx = await esbuild.context({
  outdir: "build",
  entryPoints: ["src/client/index.tsx", "src/learning/index.tsx"],
  bundle: true,
  plugins: [
    lessLoader(),
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["./assets/*"],
        to: ["./assets", "./build/client", "./build/learning"],
      },
      watch: true,
    }),
    copy({
      resolveFrom: "cwd",
      assets: {
        from: ["./index.html"],
        to: ["./build/client/index.html"],
      },
      watch: true,
    }),
    wasmPlugin,
  ],
  loader: {
    ".png": "dataurl",
    ".svg": "dataurl",
    ".obj": "dataurl",
    // ".wasm": "dataurl",
  },
  sourcemap: dev,
  minify: !dev,
});

if (dev) {
  console.log("Watching...");
  await ctx.watch();
} else {
  console.log("Building...");
  await ctx.build();
}
