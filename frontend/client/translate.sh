#!/bin/bash

if [ "$1" == "--help" -o "$1" == "-h" ]; then
    echo "Usage: $0 [INPUTFILE] [OUTPUTFILE]"
    echo "for example: $0 public/de_DE.json public/en_GB.json"
    exit 0;
fi

if [ "$1" == "" ]; then
    echo 'please provide an input file'
    exit 1
elif [ "$2" == "" ]; then
    echo 'please provide an output file'
    exit 1
fi

echo 'copy the following (without the start and end delimiter) to deepl / whatever:'
echo '##### start #####'

cat $1 | jq . | sed 1d  | sed '$d' | sed -E 's/^ *"([^"]+)": "(.*)",?$/\1 ### \2/g'

echo '##### end #####'

echo "when deepl / whatever is done, copy its output into the shell. when you're done, press enter for an empty line"
truncate -s 0 translate.tmp
while IFS= read -r line; do
    if [ "$line" == "" ]; then
        break
    fi
    echo $line >> translate.tmp
done

echo '{' > translate.out
cat translate.tmp | sed -E  's/^ *([^ ]+) *### *(.*)$/"\1": "\2",/' >> translate.out
echo ' "":""}' >> translate.out

cat translate.out | jq -r 'del(.[] | select(. == ""))' > $2

rm translate.tmp
rm translate.out

echo -n 'checking for all keys to be present ...'

original=`jq -c ". | keys" $1`
new=`jq -c ". | keys" $2`

if [ "$original" != "$new" ]; then
    echo ' files seem to have different keys'
    echo 'ERROR!!!'
else
    echo ' files seem to have the same keys! great!'
    echo 'file was created at target location:' "$2"
fi
