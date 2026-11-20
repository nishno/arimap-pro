# AgriMap Pro

[Documentation library / დოკუმენტების სარჩევი](documents/README.md) · [Run and update the application](documents/GETTING_STARTED.md) · [Illustrated guide](documents/user-guide/README.md) · [Georgian presentation](documents/presentations/README.md)

All project guides, SOPs, architecture notes, update histories and presentations are organized under **`documents/`**. Source code remains in its original directories.

```sh
npm ci --include=dev
npm run build
npm run local:start
```

Initialize a **new** local farm once with `npm run local:init`. For existing installations, keep the current farm database and follow the [local server guide](documents/operations/LOCAL_SERVER.md).
