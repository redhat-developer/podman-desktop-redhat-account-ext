# Contributing

## Certificate of Origin
 
By contributing to this project you agree to the Developer Certificate of
Origin (DCO). This document was created by the Linux Kernel community and is a
simple statement that you, as a contributor, have the legal right to make the
contribution. See the [DCO](DCO) file for details.

## Local Development

To rebuild Podman Desktop and the extension run:

```shell
  yarn build
```

To execute the extension in Podman Desktop, use one of the following to options.

With a pre-installed version of Podman Desktop:
```shell
podman-desktop --extension-folder this_folder
```

In a local git tree of Podman Desktop:
```shell
yarn watch --extension-folder this_folder
```
