#!/bin/bash
# A script that packages Disconnect for distribution.
#
# Copyright 2013 Disconnect, Inc.
#
# This program is free software: you can redistribute it and/or modify it under
# the terms of the GNU General Public License as published by the Free Software
# Foundation, either version 3 of the License, or (at your option) any later
# version.
#
# This program is distributed in the hope that it will be useful, but WITHOUT
# ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
# FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with
# this program. If not, see <http://www.gnu.org/licenses/>.
#
# Authors (one per line):
#
#   Eason Goodale <eason.goodale@gmail.com>
#   Brian Kennish <byoogle@gmail.com>
cd builds
rm search.rdf search.xpi
cd ../firefox
cfx xpi --update-link https://www.disconnect.me/extensions/search.xpi --update-url https://www.disconnect.me/search.rdf
cd ../builds
mv ../firefox/search.update.rdf search.rdf
mv ../firefox/search.xpi .
unzip search.xpi -d tmp
rm search.xpi
