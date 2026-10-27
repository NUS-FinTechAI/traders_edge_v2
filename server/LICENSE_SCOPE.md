# License scope

The [MIT license](https://github.com/NUS-FinTechAI/traders_edge_v2/blob/master/LICENSE)
applies to the original project software, tooling,
documentation and authored teaching and research content, subject to the
exceptions below. Keep the copyright and permission notice with copies or
substantial portions of the licensed work.

## Material with separate rights

| Material                                                                                                                                    | Scope                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supplied owner inputs in `docs/source/` and `docs/game-design.md`                                                                           | Remain under their rights holders' terms. The project license does not grant permission to redistribute or adapt these inputs.                                        |
| Branding artwork, image and icon files in `client/public/`, artwork in `client/ui/Logo.tsx`, and reference images in `docs/product/themes/` | Redistribution rights and any required attribution are pending the provenance review. Do not assume these assets are covered by the project license.                  |
| Third-party code, documentation, quoted material and other incorporated works                                                               | Retain their original licenses and notices. The project license does not replace those terms.                                                                         |
| Dependencies and container images                                                                                                           | Retain their own licenses, including transitive dependencies and bundled components. Review the actual versions and preserve required notices when distributing them. |

The [release readiness inventory](https://github.com/NUS-FinTechAI/traders_edge_v2/blob/master/docs/open-source/release-readiness.md#license-and-provenance)
tracks outstanding provenance and permission evidence. No ownership or reuse
permission is inferred from a file being present in this repository or in an
earlier implementation.

The project license does not grant rights to third-party names or trademarks.
Licensing the authored educational content does not establish its financial
accuracy, independent approval or effectiveness as a learning intervention.

## Packaged notices

`server/LICENSE` and `client/public/LICENSE.txt` are identical copies of the
root MIT license. This scope document is also copied to `server/LICENSE_SCOPE.md`
and `client/public/LICENSE_SCOPE.md`. Keep both sets of copies in sync.
The server package includes the license and scope in its distribution metadata;
the container retains them under `/srv/`. The client build copies both notices
to `dist/`. These notices cover the original project work described above.
They do not relicense third-party dependencies or the separately scoped materials.

Vite also writes `dist/THIRD_PARTY_LICENSES.md` from the dependencies included
in each client build. Keep that file with the deployed client. It records
bundled dependency licenses; it does not replace the provenance review or
cover separately supplied artwork.
