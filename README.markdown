# Disconnect Search

[Disconnect Search](https://www.disconnect.me/search) is a browser extension
that lets you search privately using your favorite search engine.

## Build instructions

0. Be sure to have the
   [Add-on SDK installed](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/installation.html).
1. Run `./prebuild.sh`.
2. In `builds/search.rdf`, replace:

        <em:targetApplication><Description><em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id><em:minVersion>19.0</em:minVersion><em:maxVersion>20.*</em:maxVersion><em:updateLink>https://www.disconnect.me/extensions/search.xpi</em:updateLink></Description></em:targetApplication>

   With:

        <em:targetApplication><Description><em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id><em:minVersion>1.5</em:minVersion><em:maxVersion>24.*</em:maxVersion><em:updateLink>https://www.disconnect.me/extensions/search.xpi</em:updateLink></Description></em:targetApplication><em:targetApplication><Description><em:id>{a463f10c-3994-11da-9945-000d60ca027b}</em:id><em:minVersion>0.7</em:minVersion><em:maxVersion>2.6.*</em:maxVersion><em:updateLink>https://www.disconnect.me/extensions/search.xpi</em:updateLink></Description></em:targetApplication>

3. In `builds/tmp/install.rdf`, replace:

        <!-- Firefox -->
        <em:targetApplication>
          <Description>
            <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>
            <em:minVersion>19.0</em:minVersion>
            <em:maxVersion>20.*</em:maxVersion>
          </Description>
        </em:targetApplication>

   With:

        <!-- Firefox -->
        <em:targetApplication>
          <Description>
            <em:id>{ec8030f7-c20a-464f-9b0e-13a3a9e97384}</em:id>
            <em:minVersion>1.5</em:minVersion>
            <em:maxVersion>24.*</em:maxVersion>
          </Description>
        </em:targetApplication>
        <!-- Flock -->
        <em:targetApplication>
          <Description>
            <em:id>{a463f10c-3994-11da-9945-000d60ca027b}</em:id>
            <em:minVersion>0.7</em:minVersion>
            <em:maxVersion>2.6.*</em:maxVersion>
          </Description>
        </em:targetApplication>

4. Run `./build.sh`.

## License

Copyright 2013 Disconnect, Inc.

This program, excluding brand features, is free software: you can redistribute
it and/or modify it under the terms of the GNU General Public License as
published by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the
[GNU General Public License](https://www.gnu.org/licenses/gpl.html) for more
details.
